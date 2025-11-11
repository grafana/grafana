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
import {
  Badge,
  Card,
  Drawer,
  FilterPill,
  Grid,
  IconButton,
  Input,
  Stack,
  Switch,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import config from 'app/core/config';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
import { getCategoriesLabels } from 'app/features/transformers/utils';

import { SqlExpressionsBanner } from './SqlExpressions/SqlExpressionsBanner';
import { FilterCategory } from './TransformationsEditor';
import { TransformationCardTransform } from './types';

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
      <Stack direction="column" gap={2}>
        {config?.featureToggles?.sqlExpressions && <SqlExpressionsBanner />}
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
          <Stack direction="row" alignItems="center" gap={0.5}>
            <span className={styles.switchLabel}>
              <Trans i18nKey="dashboard.transformation-picker-ng.show-images">Show images</Trans>
            </span>
            <Switch
              value={showIllustrations}
              onChange={() => onShowIllustrationsChange && onShowIllustrationsChange(!showIllustrations)}
            />
          </Stack>
        </div>

        <Stack direction="row" wrap="wrap" rowGap={1} columnGap={0.5}>
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
        </Stack>

        <TransformationsGrid
          showIllustrations={showIllustrations}
          transformations={xforms}
          data={data}
          onClick={(id) => {
            onTransformationAdd({ value: id });
          }}
        />
      </Stack>
    </Drawer>
  );
}

function getTransformationPickerStyles(theme: GrafanaTheme2) {
  return {
    pickerInformationLine: css({
      fontSize: '16px',
      marginBottom: theme.spacing(2),
    }),
    pickerInformationLineHighlight: css({
      verticalAlign: 'middle',
    }),
    searchWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: theme.spacing(2),
      rowGap: theme.spacing(1),
      width: '100%',
      paddingBottom: theme.spacing(1),
    }),
    searchInput: css({
      flexGrow: '1',
      width: 'initial',
    }),
    switchLabel: css({
      whiteSpace: 'nowrap',
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
  return (
    <Grid columns={3} gap={1}>
      {transformations.map((transform) => (
        <TransformationCard
          key={transform.id}
          transform={transform}
          showIllustrations={showIllustrations}
          onClick={onClick}
          data={data}
        />
      ))}
    </Grid>
  );
}

export interface TransformationCardProps {
  transform: TransformationCardTransform;
  onClick: (id: string) => void;
  showIllustrations?: boolean;
  data?: DataFrame[];
  showPluginState?: boolean;
  showTags?: boolean;
  testId?: string;
}

export function TransformationCard({
  transform,
  showIllustrations,
  onClick,
  data = [],
  showPluginState = true,
  showTags = true,
  testId,
}: TransformationCardProps) {
  const theme = useTheme2();
  const styles = useStyles2(getTransformationGridStyles);

  // Check if this is a full TransformerRegistryItem
  const isFullTransform = 'transformation' in transform;

  // Check to see if the transform
  // is applicable to the given data
  let applicabilityScore = TransformationApplicabilityLevels.Applicable;
  if (data.length > 0 && isFullTransform && transform.transformation.isApplicable !== undefined) {
    applicabilityScore = transform.transformation.isApplicable(data);
  }
  const isApplicable = applicabilityScore > 0;

  let applicabilityDescription = null;
  if (data.length > 0 && isFullTransform && transform.transformation.isApplicableDescription !== undefined) {
    if (typeof transform.transformation.isApplicableDescription === 'function') {
      applicabilityDescription = transform.transformation.isApplicableDescription(data);
    } else {
      applicabilityDescription = transform.transformation.isApplicableDescription;
    }
  }

  // Add disabled styles to disabled
  let cardClasses = styles.newCard;
  if (!isApplicable && data.length > 0) {
    cardClasses = cx(styles.newCard, styles.cardDisabled);
  }

  const imageUrl = isFullTransform && (theme.isDark ? transform.imageDark : transform.imageLight);
  const description = isFullTransform
    ? standardTransformersRegistry.getIfExists(transform.id)?.description
    : transform.description;

  return (
    <Card
      className={cardClasses}
      data-testid={testId || selectors.components.TransformTab.newTransform(transform.name)}
      onClick={() => onClick(transform.id)}
      noMargin
    >
      <Card.Heading className={styles.heading}>
        <div className={styles.titleRow}>
          <span>{transform.name}</span>
          {showPluginState && isFullTransform && (
            <span className={styles.pluginStateInfoWrapper}>
              <PluginStateInfo state={transform.state} />
            </span>
          )}
        </div>
        {showTags && isFullTransform && transform.tags && transform.tags.size > 0 && (
          <div className={styles.tagsWrapper}>
            {Array.from(transform.tags).map((tag) => (
              <Badge color="darkgrey" icon="tag-alt" key={tag} text={tag} />
            ))}
          </div>
        )}
      </Card.Heading>
      <Card.Description className={styles.description}>
        <span>{description}</span>
        {showIllustrations && imageUrl && (
          <span>
            <img className={styles.image} src={imageUrl} alt={transform.name} />
          </span>
        )}
        {!isApplicable && applicabilityDescription !== null && (
          <IconButton className={styles.cardApplicableInfo} name="info-circle" tooltip={applicabilityDescription} />
        )}
      </Card.Description>
    </Card>
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
      fontSize: theme.typography.bodySmall.fontSize,
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
