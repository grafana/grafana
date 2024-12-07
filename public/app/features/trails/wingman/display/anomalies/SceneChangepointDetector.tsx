/* eslint @grafana/no-untranslated-strings: "error" */
import init, { ChangepointDetector } from '@bsull/augurs/changepoint';
import { of } from 'rxjs';

import { DataFrame, DataQueryRequest, dateTime, Field, FieldType } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  ExtraQueryDataProcessor,
  ExtraQueryProvider,
  ExtraQueryDescriptor,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { ButtonGroup, Checkbox, ToolbarButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

// eslint-disable-next-line no-console
init()?.then(() => console.debug('augurs changepoints initialized'));

interface MetricState {
  changepointCount: number;
  isComplexMetric: boolean;
}

export interface Changepoint {
  idx: number;
  time: number;
  field: Field<number>;
  isComplex?: boolean;
}

interface SceneChangepointDetectorState extends SceneObjectState {
  enabled?: boolean;
  // The look-back factor to use when establishing a baseline.
  // The detector will multiply the range of the data by this factor to determine
  // the amount of data to use as training data. Defaults to 4.0.
  lookbackFactor?: number;
  lookbackFactorOptions: Array<{ label: string; value: number }>;
  onChangepointDetected?: (changepoint: Changepoint) => void;
  onComplexMetric?: () => void;
  metricStates?: { [metric: string]: MetricState };
}

// TODO: make this customisable.
export const DEFAULT_LOOKBACK_FACTOR_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '4x', value: 4 },
  { label: '10x', value: 10 },
];

export const DEFAULT_LOOKBACK_FACTOR_OPTION = {
  label: '4x',
  value: 4,
};

export class SceneChangepointDetector
  extends SceneObjectBase<SceneChangepointDetectorState>
  implements ExtraQueryProvider<SceneChangepointDetectorState>
{
  public static Component = SceneChangepointDetectorRenderer;
  public constructor(state: Partial<SceneChangepointDetectorState>) {
    super({ lookbackFactorOptions: DEFAULT_LOOKBACK_FACTOR_OPTIONS, ...state });
  }

  // Add secondary requests, used to obtain and transform the training data.
  public getExtraQueries(request: DataQueryRequest): ExtraQueryDescriptor[] {
    const extraQueries: ExtraQueryDescriptor[] = [];
    if (this.state.enabled) {
      const { to, from: origFrom } = request.range;
      const diffMs = to.diff(origFrom);
      const from = dateTime(to).subtract(this.state.lookbackFactor ?? DEFAULT_LOOKBACK_FACTOR_OPTION.value * diffMs);
      extraQueries.push({
        req: {
          ...request,
          range: {
            from,
            to,
            raw: {
              from,
              to,
            },
          },
        },
        processor: changepointProcessor(this),
      });
    }
    return extraQueries;
  }

  // Determine if the component should be re-rendered.
  public shouldRerun(prev: SceneChangepointDetectorState, next: SceneChangepointDetectorState): boolean {
    // TODO: change when we allow the state to be configured in the UI.
    return prev.enabled !== next.enabled;
  }

  public onEnabledChanged(enabled: boolean) {
    this.setState({ enabled });
  }

  public onFactorChanged(lookbackFactor: number) {
    this.setState({ lookbackFactor });
  }

  public onClearFactor() {
    this.setState({ lookbackFactor: undefined });
  }
}

// The transformation function for the changepoint detector.
//
// This function will take the secondary frame returned by the query runner and
// produce a new frame with the changepoint annotations.
const changepointProcessor: (detector: SceneChangepointDetector) => ExtraQueryDataProcessor =
  (detector) => (_, secondary) => {
    const annotations = secondary.series.map((series) => {
      // handle complex metrics
      if (series.fields.length > 2) {
        // eslint-disable-next-line no-console
        console.debug(
          'Skipping histogram/complex metric with fields:',
          series.fields.map((f) => f.name)
        );
        detector.state.onComplexMetric?.();
        return { fields: [], length: 0 };
      }

      // handle regular metrics with changepoint detection
      return createChangepointAnnotations(series, detector.state.onChangepointDetected);
    });
    return of({ timeRange: secondary.timeRange, series: [], state: secondary.state, annotations });
  };

function createChangepointAnnotations(
  frame: DataFrame,
  onChangepointDetected: ((changepoint: Changepoint) => void) | undefined
): DataFrame {
  const annotationTimes = [];
  const annotationTexts = [];
  const timeField = frame.fields.find((field) => field.type === FieldType.time);
  if (!timeField) {
    return { fields: [], length: 0 };
  }
  for (const field of frame.fields) {
    if (field.type !== FieldType.number) {
      continue;
    }
    // TODO: Pass through params to the detector.
    const cpd = ChangepointDetector.defaultArgpcp();
    const values = new Float64Array(field.values);
    const cps = cpd.detectChangepoints(values);
    for (const cp of cps.indices) {
      const time = timeField.values[cp + 1];
      annotationTimes.push(time);
      annotationTexts.push('Changepoint detected');
      onChangepointDetected?.({ idx: cp + 1, time, field });
    }
  }
  return {
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        values: annotationTimes,
        config: {},
      },
      {
        name: 'text',
        type: FieldType.string,
        values: annotationTexts,
        config: {},
      },
    ],
    length: annotationTimes.length,
    meta: {
      dataTopic: DataTopic.Annotations,
    },
  };
}

function SceneChangepointDetectorRenderer({ model }: SceneComponentProps<SceneChangepointDetector>) {
  const { enabled } = model.useState();

  const onClick = (enabled: boolean) => {
    model.onEnabledChanged(enabled);
  };

  return (
    <ButtonGroup>
      <ToolbarButton
        variant="canvas"
        tooltip="Enable changepoint detection"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick(!enabled);
        }}
      >
        <Checkbox label=" " value={enabled ?? false} onClick={() => onClick(!enabled)} />
        <Trans i18nKey="trail.metric-select.wingman.anomalies.changepoints">Changepoints</Trans>
      </ToolbarButton>
    </ButtonGroup>
  );
}
