import { css } from '@emotion/css';
import clsx from 'clsx';
import { type ReactNode, useContext, useMemo } from 'react';

import {
  type ActionModel,
  type Field,
  type GrafanaTheme2,
  type LinkModel,
  type ThemeSpacingTokens,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { ActionButton } from '../Actions/ActionButton';
import { Button } from '../Button/Button';
import { DataLinkMenuItems } from '../DataLinks/DataLinkMenuItems';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { type ResponsiveProp } from '../Layout/utils/responsiveness';
import { Menu } from '../Menu/Menu';
import { type AdHocFilterItem } from '../Table/TableNG/types';

import { VizTooltipContext } from './VizTooltipWrapper';

/** @alpha */
export interface AdHocFilterModel extends AdHocFilterItem {
  onClick: () => void;
}

/** @alpha */
export interface FilterByGroupedLabelsModel {
  onFilterForGroupedLabels?: () => void;
  onFilterOutGroupedLabels?: () => void;
}

/** @alpha */
export interface VizTooltipFooterProps {
  /** Data links to render as clickable buttons. Defaults to an empty array. */
  dataLinks?: Array<LinkModel<Field>>;
  /** Actions to render as clickable buttons. */
  actions?: Array<ActionModel<Field>>;
  /** Ad hoc filter buttons, typically used to filter dashboards by a label/value pair. */
  adHocFilters?: AdHocFilterModel[];
  /** Controls rendering of grouped label filter buttons (filter for / filter out). */
  filterByGroupedLabels?: FilterByGroupedLabelsModel;
  /** Callback to open the annotation editor for the hovered point. */
  annotate?: () => void;
  /** Content rendered at the end of the footer. */
  additionalContent?: ReactNode;
}

const ADD_ANNOTATION_ID = 'add-annotation-button';

type RenderOneClickTrans = (title: string) => React.ReactNode;
type RenderItem<T extends LinkModel | ActionModel> = (
  item: T,
  idx: number,
  styles: ReturnType<typeof getStyles>
) => React.ReactNode;

function makeRenderLinksOrActions<T extends LinkModel | ActionModel>(
  renderOneClickTrans: RenderOneClickTrans,
  renderItem: RenderItem<T>,
  itemGap?: ResponsiveProp<ThemeSpacingTokens>
) {
  const renderLinksOrActions = (items: T[], styles: ReturnType<typeof getStyles>) => {
    if (items.length === 0) {
      return;
    }

    const oneClickItem = items.find((item) => item.oneClick === true);

    if (oneClickItem != null) {
      return (
        <div className={styles.footerSection}>
          <Stack direction="column" justifyContent="flex-start" gap={0.5}>
            <span className={styles.oneClickWrapper}>
              <Icon name="info-circle" size="lg" className={styles.infoIcon} />
              {renderOneClickTrans(oneClickItem.title)}
            </span>
          </Stack>
        </div>
      );
    }

    return (
      <div className={styles.footerSection}>
        <Stack direction="column" justifyContent="flex-start" gap={itemGap}>
          {items.map((item, i) => renderItem(item, i, styles))}
        </Stack>
      </div>
    );
  };

  return renderLinksOrActions;
}

const renderActions = makeRenderLinksOrActions<ActionModel>(
  (title) => <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-action">Click to {{ actionTitle: title }}</Trans>,
  (item, i) => <ActionButton key={i} action={item} variant="secondary" />
);

/** @alpha */
export const VizTooltipFooter = ({
  dataLinks = [],
  actions = [],
  annotate,
  adHocFilters = [],
  filterByGroupedLabels,
  additionalContent,
}: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);
  const context = useContext(VizTooltipContext);
  const hasOneClickLink = useMemo(() => dataLinks.some((link) => link.oneClick === true), [dataLinks]);
  const hasOneClickAction = useMemo(() => actions.some((action) => action.oneClick === true), [actions]);

  return (
    <div
      className={clsx(
        styles.wrapper,
        !hasOneClickLink && !hasOneClickAction && dataLinks.length > 0 && styles.linkSeparator
      )}
    >
      {!hasOneClickAction &&
        dataLinks.length > 0 &&
        (hasOneClickLink ? (
          <div className={styles.footerSection}>
            <span className={styles.oneClickWrapper}>
              <Icon name="info-circle" size="lg" className={styles.infoIcon} />
              <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-navigate">
                Click to open {{ linkTitle: dataLinks.find((link) => link.oneClick)?.title }}
              </Trans>
            </span>
          </div>
        ) : (
          <Menu
            autoFocus={false}
            {...context?.menuProps}
            onKeyDownCapture={(event) => {
              context?.menuProps?.onKeyDownCapture?.(event);
              if (event.isPropagationStopped() || event.defaultPrevented) {
                return;
              }
              // Keep footer controls reachable and avoid activating anchors twice on Space.
              if (event.key === 'Tab') {
                event.stopPropagation();
              } else if (event.key === ' ' && event.target instanceof HTMLAnchorElement) {
                event.preventDefault();
                event.stopPropagation();
                event.target.click();
              }
            }}
          >
            <DataLinkMenuItems links={dataLinks} />
          </Menu>
        ))}
      {!hasOneClickLink && renderActions(actions, styles)}
      {!hasOneClickLink && !hasOneClickAction && adHocFilters.length > 0 && (
        <div className={styles.footerSection}>
          {adHocFilters.map((item, index) => (
            <Button key={index} icon="filter" variant="secondary" size="sm" onClick={item.onClick}>
              <Trans i18nKey="grafana-ui.viz-tooltip.footer-filter-for-value">
                Filter for &apos;{{ value: item.value }}&apos;
              </Trans>
            </Button>
          ))}
        </div>
      )}

      {!hasOneClickLink && !hasOneClickAction && filterByGroupedLabels && (
        <div className={styles.footerSection}>
          <Stack direction="column" gap={0.5} width="fit-content">
            <Button
              icon="filter"
              variant="secondary"
              size="sm"
              onClick={filterByGroupedLabels.onFilterForGroupedLabels}
              data-testid={selectors.components.VizTooltipFooter.buttons.apply}
            >
              <Trans i18nKey="grafana-ui.viz-tooltip.footer-apply-series-as-filter">Filter on this value</Trans>
            </Button>
            <Button
              icon="filter"
              variant="secondary"
              size="sm"
              onClick={filterByGroupedLabels.onFilterOutGroupedLabels}
              data-testid={selectors.components.VizTooltipFooter.buttons.applyInverse}
            >
              <Trans i18nKey="grafana-ui.viz-tooltip.footer-apply-series-as-inverse-filter">
                Filter out this value
              </Trans>
            </Button>
          </Stack>
        </div>
      )}
      {!hasOneClickLink && !hasOneClickAction && annotate != null && (
        <div className={styles.footerSection}>
          <Button icon="comment-alt" variant="secondary" size="sm" id={ADD_ANNOTATION_ID} onClick={annotate}>
            <Trans i18nKey="grafana-ui.viz-tooltip.footer-add-annotation">Add annotation</Trans>
          </Button>
        </div>
      )}
      {additionalContent}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(0),
    '& > [role="menu"]': {
      border: 'none',
      boxShadow: 'none',
      display: 'block',
      maxWidth: '100%',
      '& a, & a span': {
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
      },
    },
  }),
  linkSeparator: css({
    '&:not(:first-child)': {
      borderTop: `1px solid ${theme.colors.border.medium}`,
    },
  }),
  footerSection: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  oneClickWrapper: css({
    display: 'flex',
    alignItems: 'center',
  }),
  infoIcon: css({
    color: theme.colors.primary.main,
    paddingRight: theme.spacing(0.5),
  }),
});
