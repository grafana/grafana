import { css, cx } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Dropdown, Icon, Menu, Stack, Text, useStyles2 } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';
import MoreButton from '../../components/MoreButton';
import { Spacer } from '../../components/Spacer';

interface EvaluationGroupProps extends PropsWithChildren {
  name: string;
  interval?: string;
  provenance?: string;
  isOpen?: boolean;
  onToggle: () => void;
}

export const EvaluationGroup = ({
  name,
  provenance,
  interval,
  onToggle,
  isOpen = false,
  children,
}: EvaluationGroupProps) => {
  const styles = useStyles2(getStyles);

  const isProvisioned = Boolean(provenance);

  return (
    <Stack direction="column" role="treeitem" aria-expanded={isOpen} aria-selected="false" gap={0}>
      <div className={styles.headerWrapper}>
        <Stack direction="row" alignItems="center" gap={1}>
          <button className={cx(styles.hiddenButton, styles.largerClickTarget)} type="button" onClick={onToggle}>
            <Stack alignItems="center" gap={0.5}>
              <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
              <Text truncate variant="body">
                {name}
              </Text>
            </Stack>
          </button>
          {isProvisioned && (
            <Badge color="purple" text={t('alerting.evaluation-group.text-provisioned', 'Provisioned')} />
          )}
          <Spacer />
          {interval && <MetaText icon="history">{interval}</MetaText>}
          <Button size="sm" icon="pen" variant="secondary" disabled={isProvisioned} data-testid="edit-group-action">
            <Trans i18nKey="common.edit">Edit</Trans>
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  label={t('alerting.evaluation-group.label-reorder-rules', 'Re-order rules')}
                  icon="flip"
                  disabled={isProvisioned}
                />
                <Menu.Divider />
                <Menu.Item label={t('alerting.evaluation-group.label-export', 'Export')} icon="download-alt" />
                <Menu.Item
                  label={t('alerting.evaluation-group.label-delete', 'Delete')}
                  icon="trash-alt"
                  destructive
                  disabled={isProvisioned}
                />
              </Menu>
            }
          >
            <MoreButton size="sm" />
          </Dropdown>
        </Stack>
      </div>
      {isOpen && <div role="group">{children}</div>}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerWrapper: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,

    background: theme.colors.background.secondary,

    border: 'none',
    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  }),
  hiddenButton: css({
    border: 'none',
    background: 'transparent',
  }),
  largerClickTarget: css({
    padding: theme.spacing(0.5),
    margin: `-${theme.spacing(0.5)}`,
  }),
});
