import { css } from '@emotion/css';

import { BusEventBase, ReducerID, SelectableValue, fieldReducers, GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
// import { getLabelValueFromDataFrame } from 'services/levels';
import { Select, useStyles2 } from '@grafana/ui';
import { Field, IconButton } from '@grafana/ui/';
import { Trans } from 'app/core/internationalization';

// import { getSortByPreference, setSortByPreference } from 'services/store';

export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  sortBy: string;
  direction: string;
}

const sortByTooltip =
  'Calculate a derived quantity from the values in your time series and sort by this criteria. Defaults to standard deviation.';

export class SortCriteriaChanged extends BusEventBase {
  constructor(
    public sortBy: string,
    public direction: string
  ) {
    super();
  }

  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions = [
    {
      value: 'changepoint',
      label: 'Relevance',
      description: 'Most relevant time series first',
    },
    {
      value: ReducerID.stdDev,
      label: 'Dispersion',
      description: 'Standard deviation of all values in a field',
    },
    ...fieldReducers.selectOptions([], (ext) => ext.id !== ReducerID.stdDev).options,
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    // const { sortBy, direction } = getSortByPreference(state.target, 'changepoint', 'desc');
    super({
      target: state.target,
      sortBy: 'changepoint',
      direction: 'desc',
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<string>) => {
    if (!criteria.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    // setSortByPreference(this.state.target, criteria.value, this.state.direction);
    this.publishEvent(new SortCriteriaChanged(criteria.value, this.state.direction), true);
  };

  public onDirectionChange = (direction: SelectableValue<string>) => {
    if (!direction.value) {
      return;
    }
    this.setState({ direction: direction.value });
    // setSortByPreference(this.state.target, this.state.sortBy, direction.value);
    this.publishEvent(new SortCriteriaChanged(this.state.sortBy, direction.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { sortBy, direction } = model.useState();
    const styles = useStyles2(getStyles);
    const value = model.sortingOptions.find(({ value }) => value === sortBy);
    return (
      <>
        <Field label="Sort direction" className={styles.sortDirection}>
          <Select
            onChange={model.onDirectionChange}
            placeholder=""
            value={direction}
            options={[
              {
                label: 'Asc',
                value: 'asc',
              },
              {
                label: 'Desc',
                value: 'desc',
              },
            ]}
          />
        </Field>
        <Field
          label={
            <div className={styles.displayOptionTooltip}>
              <Trans i18nKey="explore-metrics.sortBy">Sort by</Trans>
              <IconButton name={'info-circle'} size="sm" variant={'secondary'} tooltip={sortByTooltip} />
            </div>
          }
          className={styles.displayOption}
        >
          <Select
            value={value}
            isSearchable={true}
            options={model.sortingOptions}
            placeholder={'Choose criteria'}
            onChange={model.onCriteriaChange}
            inputId="sort-by-criteria"
          />
        </Field>
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    displayOption: css({
      flexGrow: 0,
      marginBottom: 0,
      minWidth: '184px',
    }),
    sortDirection: css({
      flexGrow: 0,
      marginBottom: 0,
      minWidth: '100px',
    }),
    displayOptionTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
}

// export function getLabelValue(frame: DataFrame) {
//   return getLabelValueFromDataFrame(frame) ?? 'No labels';
// }
