import { cx, css } from '@emotion/css';
import { FormEventHandler, KeyboardEventHandler, ReactNode, useCallback } from 'react';

import {
  DataFrame,
  TransformerRegistryItem,
  TransformationApplicabilityLevels,
  GrafanaTheme2,
  standardTransformersRegistry,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Badge, Card, Drawer, FilterPill, IconButton, Input, Switch, useStyles2, useTheme2 } from '@grafana/ui';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
import { getCategoriesLabels } from 'app/features/transformers/utils';

import { FilterCategory } from './TransformationsEditor';

const VIEW_ALL_VALUE = 'viewAll';

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

  const filterCategoriesLabels: Array<[FilterCategory, string]> = [
    [VIEW_ALL_VALUE, t('dashboard.transformation-picker-ng.view-all', 'View all')],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ...(Object.entries(getCategoriesLabels()) as Array<[FilterCategory, string]>),
  ];

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
      title={t('dashboard.transformation-picker-ng.title-add-another-transformation', 'Add another transformation')}
    >
      <div className={styles.searchWrapper}>
        <Input
          data-testid={selectors.components.Transforms.searchInput}
          className={styles.searchInput}
          value={search ?? ''}
          placeholder={t(
            'dashboard.transformation-picker-ng.placeholder-search-for-transformation',
            'Search for transformation'
          )}
          onChange={onSearchChange}
          onKeyDown={onSearchKeyDown}
          suffix={suffix}
          ref={searchInputRef}
          autoFocus={true}
        />
        <div className={styles.showImages}>
          <span className={styles.illustationSwitchLabel}>
            <Trans i18nKey="dashboard.transformation-picker-ng.show-images">Show images</Trans>
          </span>{' '}
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
      paddingBottom: theme.spacing(1),
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
  const theme = useTheme2();
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

        const imageUrl = theme.isDark ? transform.imageDark : transform.imageLight;

        return (
          <Card
            className={cardClasses}
            data-testid={selectors.components.TransformTab.newTransform(transform.name)}
            onClick={() => onClick(transform.id)}
            key={transform.id}
          >
            <Card.Heading className={styles.heading}>
              <div className={styles.titleRow}>
                <span>{transform.name}</span>
                <span className={styles.pluginStateInfoWrapper}>
                  <PluginStateInfo state={transform.state} />
                </span>
              </div>
              {transform.tags && transform.tags.size > 0 && (
                <div className={styles.tagsWrapper}>
                  {Array.from(transform.tags).map((tag) => (
                    <Badge color="darkgrey" icon="tag-alt" key={tag} text={tag} />
                  ))}
                </div>
              )}
            </Card.Heading>
            <Card.Description className={styles.description}>
              <span>{standardTransformersRegistry.getIfExists(transform.id)?.description}</span>
              {showIllustrations && (
                <span>
                  <img className={styles.image} src={imageUrl} alt={transform.name} />
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
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
      },
    }),
    titleRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'nowrap',
      width: '100%',
    }),
    description: css({
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }),
    image: css({
      display: 'block',
      maxWidth: '100%',
      marginTop: theme.spacing(2),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gridAutoRows: '1fr',
      gap: theme.spacing(1),
      width: '100%',
      padding: `${theme.spacing(1)} 0`,
    }),
    cardDisabled: css({
      backgroundColor: theme.colors.action.disabledBackground,
      img: {
        filter: 'grayscale(100%)',
        opacity: 0.33,
      },
    }),
    cardApplicableInfo: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
    newCard: css({
      gridTemplateRows: 'min-content 0 1fr 0',
      marginBottom: 0,
    }),
    pluginStateInfoWrapper: css({
      marginLeft: theme.spacing(0.5),
    }),
    tagsWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
  };
}
