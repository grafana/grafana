import { css } from '@emotion/css';

import { BusEventBase, DataFrame, GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, Select } from '@grafana/ui';
import { Field, useStyles2 } from '@grafana/ui/';

import { Trans } from '../../../core/internationalization';
import { getLabelValueFromDataFrame } from '../services/levels';
import { getSortByPreference, setSortByPreference } from '../services/store';

export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  sortBy: string;
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(
    public target: 'fields' | 'labels',
    public sortBy: string
  ) {
    super();
  }

  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions = [
    {
      label: '',
      options: [
        {
          value: 'outliers',
          label: 'Detected outliers',
          description: 'Order by the amount of detected outliers in the data',
        },
        {
          value: ReducerID.stdDev,
          label: 'Widest spread',
          description: 'Sort graphs by deviation from the average value',
        },
        {
          value: 'alphabetical',
          label: 'Name [A-Z]',
          description: 'Alphabetical order',
        },
        {
          value: 'alphabetical-reversed',
          label: 'Name [Z-A]',
          description: 'Reversed alphabetical order',
        },
      ],
    },
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    const { sortBy } = getSortByPreference(state.target, 'outliers');
    super({
      target: state.target,
      sortBy,
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<string>) => {
    if (!criteria.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    setSortByPreference(this.state.target, criteria.value);
    this.publishEvent(new SortCriteriaChanged(this.state.target, criteria.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const styles = useStyles2(getStyles);
    const { sortBy } = model.useState();
    const group = model.sortingOptions.find((group) => group.options.find((option) => option.value === sortBy));
    const value = group?.options.find((option) => option.value === sortBy);
    return (
      <Field
        htmlFor="sort-by-criteria"
        label={
          <div className={styles.sortByTooltip}>
            <Trans i18nKey="explore-metrics.breakdown.sortBy">Sort by</Trans>
            <IconButton
              name={'info-circle'}
              size="sm"
              variant={'secondary'}
              tooltip="Sorts by a calculation based on time series values. Defaults to standard deviation."
            />
          </div>
        }
      >
        <Select
          value={value}
          width={20}
          isSearchable={true}
          options={model.sortingOptions}
          placeholder={'Choose criteria'}
          onChange={model.onCriteriaChange}
          inputId="sort-by-criteria"
        />
      </Field>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sortByTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
