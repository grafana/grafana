import { cx, css } from '@emotion/css';
import { FormEventHandler, KeyboardEventHandler, ReactNode, useCallback } from 'react';

import {
  DataFrame,
  DataTransformerID,
  TransformerRegistryItem,
  TransformationApplicabilityLevels,
  GrafanaTheme2,
  standardTransformersRegistry,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Card, Drawer, FilterPill, IconButton, Input, Switch, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
import { categoriesLabels } from 'app/features/transformers/utils';

import { FilterCategory } from './TransformationsEditor';

const viewAllLabel = 'View all';
const VIEW_ALL_VALUE = 'viewAll';
const filterCategoriesLabels: Array<[FilterCategory, string]> = [
  [VIEW_ALL_VALUE, viewAllLabel],
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ...(Object.entries(categoriesLabels) as Array<[FilterCategory, string]>),
];

interface TransformationPickerNgProps {
  onTransformationAdd: (selectedItem: SelectableValue<string>) => void;
  onSearchChange: FormEventHandler<HTMLInputElement>;
  onSearchKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onClose?: () => void;
  noTransforms: boolean;
  xforms: TransformerRegistryItem[];
  search: string;
  suffix: ReactNode;
  data: DataFrame[];
  showIllustrations?: boolean;
  onShowIllustrationsChange?: (showIllustrations: boolean) => void;
  onSelectedFilterChange?: (category: FilterCategory) => void;
  selectedFilter?: FilterCategory;
}

export function TransformationPickerNg(props: TransformationPickerNgProps) {
  const styles = useStyles2(getTransformationPickerStyles);
  const {
    suffix,
    xforms,
    search,
    onSearchChange,
    onSearchKeyDown,
    showIllustrations,
    onTransformationAdd,
    selectedFilter,
    data,
    onClose,
    onShowIllustrationsChange,
    onSelectedFilterChange,
  } = props;

  // Use a callback ref to call "click" on the search input
  // This will focus it when it's opened
  const searchInputRef = useCallback((input: HTMLInputElement) => {
    input?.click();
  }, []);

  return (
    <Drawer
      size="md"
      onClose={() => {
        onClose && onClose();
      }}
      title="Add another transformation"
    >
      <div className={styles.searchWrapper}>
        <Input
          data-testid={selectors.components.Transforms.searchInput}
          className={styles.searchInput}
          value={search ?? ''}
          placeholder="Search for transformation"
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          suffix={suffix}
          ref={searchInputRef}
          autoFocus={true}
        />
        <div className={styles.showImages}>
          <span className={styles.illustationSwitchLabel}>Show images</span>{' '}
          <Switch
            value={showIllustrations}
            onChange={() => onShowIllustrationsChange && onShowIllustrationsChange(!showIllustrations)}
          />
        </div>
      </div>

      <div className={styles.filterWrapper}>
        {filterCategoriesLabels.map(([slug, label]) => {
          return (
            <FilterPill
              key={slug}
              onClick={() => onSelectedFilterChange && onSelectedFilterChange(slug)}
              label={label}
              selected={selectedFilter === slug}
            />
          );
        })}
      </div>

      <TransformationsGrid
        showIllustrations={showIllustrations}
        transformations={xforms}
        data={data}
        onClick={(id) => {
          onTransformationAdd({ value: id });
        }}
      />
    </Drawer>
  );
}

function getTransformationPickerStyles(theme: GrafanaTheme2) {
  return {
    showImages: css({
      flexBasis: '0',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }),
    pickerInformationLine: css({
      fontSize: '16px',
      marginBottom: `${theme.spacing(2)}`,
    }),
    pickerInformationLineHighlight: css({
      verticalAlign: 'middle',
    }),
    searchWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: '27px',
      rowGap: '16px',
      width: '100%',
    }),
    searchInput: css({
      flexGrow: '1',
      width: 'initial',
    }),
    illustationSwitchLabel: css({
      whiteSpace: 'nowrap',
    }),
    filterWrapper: css({
      padding: `${theme.spacing(1)} 0`,
      display: 'flex',
      flexWrap: 'wrap',
      rowGap: `${theme.spacing(1)}`,
      columnGap: `${theme.spacing(0.5)}`,
    }),
  };
}

interface TransformationsGridProps {
  transformations: TransformerRegistryItem[];
  showIllustrations?: boolean;
  onClick: (id: string) => void;
  data: DataFrame[];
}

function TransformationsGrid({ showIllustrations, transformations, onClick, data }: TransformationsGridProps) {
  const styles = useStyles2(getTransformationGridStyles);

  return (
    <div className={styles.grid}>
      {transformations.map((transform) => {
        // Check to see if the transform
        // is applicable to the given data
        let applicabilityScore = TransformationApplicabilityLevels.Applicable;
        if (transform.transformation.isApplicable !== undefined) {
          applicabilityScore = transform.transformation.isApplicable(data);
        }
        const isApplicable = applicabilityScore > 0;

        let applicabilityDescription = null;
        if (transform.transformation.isApplicableDescription !== undefined) {
          if (typeof transform.transformation.isApplicableDescription === 'function') {
            applicabilityDescription = transform.transformation.isApplicableDescription(data);
          } else {
            applicabilityDescription = transform.transformation.isApplicableDescription;
          }
        }

        // Add disabled styles to disabled
        let cardClasses = styles.newCard;
        if (!isApplicable) {
          cardClasses = cx(styles.newCard, styles.cardDisabled);
        }

        return (
          <Card
            className={cardClasses}
            data-testid={selectors.components.TransformTab.newTransform(transform.name)}
            onClick={() => onClick(transform.id)}
            key={transform.id}
          >
            <Card.Heading className={styles.heading}>
              <span>{transform.name}</span>
              <span className={styles.pluginStateInfoWrapper}>
                <PluginStateInfo state={transform.state} />
              </span>
            </Card.Heading>
            <Card.Description className={styles.description}>
              <span>{getTransformationsRedesignDescriptions(transform.id)}</span>
              {showIllustrations && (
                <span>
                  <img className={styles.image} src={getImagePath(transform.id, !isApplicable)} alt={transform.name} />
                </span>
              )}
              {!isApplicable && applicabilityDescription !== null && (
                <IconButton
                  className={styles.cardApplicableInfo}
                  name="info-circle"
                  tooltip={applicabilityDescription}
                />
              )}
            </Card.Description>
          </Card>
        );
      })}
    </div>
  );
}

function getTransformationGridStyles(theme: GrafanaTheme2) {
  return {
    heading: css({
      fontWeight: 400,
      '> button': {
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'nowrap',
      },
    }),
    description: css({
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }),
    image: css({
      display: 'block',
      maxEidth: '100%`',
      marginTop: `${theme.spacing(2)}`,
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gridAutoRows: '1fr',
      gap: `${theme.spacing(2)} ${theme.spacing(1)}`,
      width: '100%',
    }),
    cardDisabled: css({
      backgroundColor: 'rgb(204, 204, 220, 0.045)',
      color: `${theme.colors.text.disabled} !important`,
      img: {
        filter: 'grayscale(100%)',
        opacity: 0.33,
      },
    }),
    cardApplicableInfo: css({
      position: 'absolute',
      bottom: `${theme.spacing(1)}`,
      right: `${theme.spacing(1)}`,
    }),
    newCard: css({
      gridTemplateRows: 'min-content 0 1fr 0',
    }),
    pluginStateInfoWrapper: css({
      marginLeft: '5px',
    }),
  };
}

const getImagePath = (id: string, disabled: boolean) => {
  const folder = config.theme2.isDark ? 'dark' : 'light';
  return `public/img/transformations/${folder}/${id}.svg`;
};

const TransformationDescriptionOverrides: { [key: string]: string } = {
  [DataTransformerID.concatenate]: 'Combine all fields into a single frame.',
  [DataTransformerID.configFromData]: 'Set unit, min, max and more.',
  [DataTransformerID.fieldLookup]: 'Use a field value to lookup countries, states, or airports.',
  [DataTransformerID.filterFieldsByName]: 'Remove parts of the query results using a regex pattern.',
  [DataTransformerID.filterByRefId]: 'Remove rows from the data based on origin query',
  [DataTransformerID.filterByValue]: 'Remove rows from the query results using user-defined filters.',
  [DataTransformerID.groupBy]: 'Group data by a field value and create aggregate data.',
  [DataTransformerID.groupingToMatrix]: 'Summarize and reorganize data based on three fields.',
  [DataTransformerID.joinByField]: 'Combine rows from 2+ tables, based on a related field.',
  [DataTransformerID.labelsToFields]: 'Group series by time and return labels or tags as fields.',
  [DataTransformerID.merge]: 'Merge multiple series. Values will be combined into one row.',
  [DataTransformerID.organize]: 'Re-order, hide, or rename fields.',
  [DataTransformerID.partitionByValues]: 'Split a one-frame dataset into multiple series.',
  [DataTransformerID.prepareTimeSeries]: 'Stretch data frames from the wide format into the long format.',
  [DataTransformerID.reduce]: 'Reduce all rows or data points to a single value (ex. max, mean).',
  [DataTransformerID.renameByRegex]:
    'Rename parts of the query results using a regular expression and replacement pattern.',
  [DataTransformerID.seriesToRows]: 'Merge multiple series. Return time, metric and values as a row.',
};

const getTransformationsRedesignDescriptions = (id: string): string => {
  return TransformationDescriptionOverrides[id] || standardTransformersRegistry.getIfExists(id)?.description || '';
};
