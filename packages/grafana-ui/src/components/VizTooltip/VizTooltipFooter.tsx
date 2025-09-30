import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { ActionModel, Field, GrafanaTheme2, LinkModel, ThemeSpacingTokens } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { ActionButton } from '../Actions/ActionButton';
import { Button } from '../Button/Button';
import { DataLinkButton } from '../DataLinks/DataLinkButton';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { ResponsiveProp } from '../Layout/utils/responsiveness';
import { Menu } from '../Menu/Menu';
import { AdHocFilterItem } from '../Table/TableNG/types';

export interface AdHocFilterModel extends AdHocFilterItem {
  onClick: () => void;
  displayName?: string;
}

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  actions?: Array<ActionModel<Field>>;
  adHocFilters?: AdHocFilterModel[];
  annotate?: () => void;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

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

const renderDataLinks = makeRenderLinksOrActions<LinkModel>(
  (title) => (
    <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-navigate">Click to open {{ linkTitle: title }}</Trans>
  ),
  (item, i, styles) => (
    <DataLinkButton link={item} key={i} buttonProps={{ className: styles.dataLinkButton, fill: 'text' }} />
  ),
  0.5
);

const renderActions = makeRenderLinksOrActions<ActionModel>(
  (title) => <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-action">Click to {{ actionTitle: title }}</Trans>,
  (item, i) => <ActionButton key={i} action={item} variant="secondary" />
);

export const VizTooltipFooter = ({ dataLinks, actions = [], annotate, adHocFilters = [] }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);
  const hasOneClickLink = useMemo(() => dataLinks.some((link) => link.oneClick === true), [dataLinks]);
  const hasOneClickAction = useMemo(() => actions.some((action) => action.oneClick === true), [actions]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const onFilterToggle = useCallback((open: boolean) => {
    setIsFilterOpen(open);
  }, []);

  return (
    <div className={styles.wrapper}>
      {!hasOneClickAction && renderDataLinks(dataLinks, styles)}
      {!hasOneClickLink && renderActions(actions, styles)}
      {!hasOneClickLink && !hasOneClickAction && adHocFilters.length > 0 && (
        <div className={styles.footerSection}>
          {adHocFilters.length === 1 ? (
            <Button icon="filter" variant="secondary" size="sm" onClick={adHocFilters[0].onClick}>
              <Trans i18nKey="grafana-ui.viz-tooltip.footer-filter-for-field-value">
                Filter for {{ value: adHocFilters[0].value }}
              </Trans>
            </Button>
          ) : (
            <Dropdown
              overlay={
                <Menu>
                  {adHocFilters.map((item, index) => (
                    <Menu.Item
                      key={index}
                      label={t(
                        'grafana-ui.viz-tooltip.footer-filter-for-field-value',
                        'Filter {{ fieldName }} for {{ value }}',
                        {
                          fieldName: item.displayName || item.key,
                          value: item.value,
                        }
                      )}
                      icon="filter"
                      onClick={item.onClick}
                    />
                  ))}
                </Menu>
              }
              placement="bottom-start"
              onVisibleChange={onFilterToggle}
            >
              <Button icon="filter" variant="secondary" size="sm" aria-haspopup="menu" aria-expanded={isFilterOpen}>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Trans i18nKey="grafana-ui.viz-tooltip.footer-filter-options">Filter options</Trans>
                  <Icon name={isFilterOpen ? 'angle-up' : 'angle-down'} size="sm" aria-hidden="true" />
                </Stack>
              </Button>
            </Dropdown>
          )}
        </div>
      )}
      {!hasOneClickLink && !hasOneClickAction && annotate != null && (
        <div className={styles.footerSection}>
          <Button icon="comment-alt" variant="secondary" size="sm" id={ADD_ANNOTATION_ID} onClick={annotate}>
            <Trans i18nKey="grafana-ui.viz-tooltip.footer-add-annotation">Add annotation</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(0),
  }),
  footerSection: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  dataLinkButton: css({
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
      background: 'none',
    },
    padding: 0,
    height: 'auto',
    '& span': {
      whiteSpace: 'normal',
      textAlign: 'left',
    },
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
