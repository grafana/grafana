import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs';

import {
  DataFrame,
  DataTransformContext,
  DataTransformerConfig,
  GrafanaTheme2,
  StandardEditorContext,
  StandardEditorsRegistryItem,
  transformDataFrame,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataTopic } from '@grafana/schema';
import { Field, Select, useStyles2 } from '@grafana/ui';
import { FrameMultiSelectionEditor } from 'app/plugins/panel/geomap/editor/FrameSelectionEditor';

import { TransformationData } from './TransformationsEditor';
import { TransformationsEditorTransformation } from './types';

interface TransformationFilterProps {
  index: number;
  config: DataTransformerConfig;
  data: TransformationData;
  onChange: (index: number, config: DataTransformerConfig) => void;
  configs: TransformationsEditorTransformation[];
}

export const TransformationFilter = ({ index, data, config, onChange, configs }: TransformationFilterProps) => {
  const styles = useStyles2(getStyles);
  const [outputs, setOutputs] = useState<DataFrame[]>([]);

  const setOutputWithoutDuplicateQueries = useCallback((frames: DataFrame[]) => {
    const queryRefIdSet = new Set();
    const filteredFrames: DataFrame[] = [];
    for (const frame of frames) {
      console.log({ queryRefIdSet, frame });
      if (!frame.refId) {
        filteredFrames.push(frame);
        continue;
      }

      if (frame.refId && !queryRefIdSet.has(frame.refId)) {
        filteredFrames.push(frame);
        queryRefIdSet.add(frame.refId);
      }
    }
    return filteredFrames;
  }, []);

  useEffect(() => {
    const prevTransformIndex = index - 1;
    let inputTransforms: Array<DataTransformerConfig<{}>> = [];
    let outputTransforms: Array<DataTransformerConfig<{}>> = [];
    if (prevTransformIndex >= 0) {
      inputTransforms = configs.slice(0, prevTransformIndex).map((t) => {
        return t.transformation;
      });
      outputTransforms = configs.slice(prevTransformIndex, index).map((t) => {
        return t.transformation;
      });
    }

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    // const first = transformDataFrame(inputTransforms, data.series, ctx).subscribe(setFirst);
    console.log('outputTransforms', outputTransforms);
    const outputSubscription = transformDataFrame(inputTransforms, data.series, ctx)
      .pipe(mergeMap((before) => transformDataFrame(outputTransforms, before, ctx)))
      .subscribe(setOutputs);

    return function unsubscribe() {
      outputSubscription.unsubscribe();
    };
  }, [index, data, configs]);

  useEffect(() => {
    console.log(`outputs - ${index}`, outputs);
  }, [outputs, index]);

  const opts = useMemo(() => {
    const combinedQueriesAndTransforms = index
      ? setOutputWithoutDuplicateQueries([...data.series, ...outputs])
      : data.series;

    return {
      // eslint-disable-next-line
      context: { data: combinedQueriesAndTransforms } as StandardEditorContext<unknown>,
      showTopic: true || data.annotations?.length || config.topic?.length,
      showFilter: config.topic !== DataTopic.Annotations,
      source: [
        { value: DataTopic.Series, label: `Query and Transformation results` },
        { value: DataTopic.Annotations, label: `Annotation data` },
      ],
    };
  }, [index, setOutputWithoutDuplicateQueries, data.series, data.annotations?.length, outputs, config.topic]);

  return (
    <div className={styles.wrapper}>
      <Field label="Apply transformation to">
        <>
          {opts.showTopic && (
            <Select
              isClearable={true}
              options={opts.source}
              value={opts.source.find((v) => v.value === config.topic)}
              placeholder={opts.source[0].label}
              className={styles.padded}
              onChange={(option) => {
                onChange(index, {
                  ...config,
                  topic: option?.value,
                });
              }}
            />
          )}
          {opts.showFilter && (
            <FrameMultiSelectionEditor
              value={config.filter!}
              context={opts.context}
              // eslint-disable-next-line
              item={{} as StandardEditorsRegistryItem}
              onChange={(filter) => onChange(index, { ...config, filter })}
            />
          )}
        </>
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.radius.default;

  return {
    wrapper: css({
      padding: theme.spacing(2),
      border: `2px solid ${theme.colors.background.secondary}`,
      borderTop: `none`,
      borderRadius: `0 0 ${borderRadius} ${borderRadius}`,
      position: `relative`,
      top: `-4px`,
    }),
    padded: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
