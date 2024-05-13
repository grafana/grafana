import { css, cx } from '@emotion/css';
import React, { PropsWithChildren, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Badge, Button, Dropdown, Menu, Stack, Text, Icon } from '@grafana/ui';

import { MetaText } from '../MetaText';
import MoreButton from '../MoreButton';
import { Spacer } from '../Spacer';

interface EvaluationGroupProps extends PropsWithChildren {
  name: string;
  description?: ReactNode;
  interval?: string;
  provenance?: string;
  isOpen?: boolean;
  onToggle: () => void;
}

const EvaluationGroup = ({
  name,
  description,
  provenance,
  interval,
  onToggle,
  isOpen = false,
  children,
}: EvaluationGroupProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupWrapper} role="treeitem" aria-expanded={isOpen} aria-selected="false">
      <EvaluationGroupHeader
        onToggle={onToggle}
        provenance={provenance}
        isOpen={isOpen}
        description={description}
        name={name}
        interval={interval}
      />
      {isOpen && <div role="group">{children}</div>}
    </div>
  );
};

const EvaluationGroupHeader = (props: EvaluationGroupProps) => {
  const { name, description, provenance, interval, isOpen = false, onToggle } = props;

  const styles = useStyles2(getStyles);
  const isProvisioned = Boolean(provenance);

  return (
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
        {isProvisioned && <Badge color="purple" text="Provisioned" />}
        {description && <MetaText>{description}</MetaText>}
        <Spacer />
        {interval && (
          <MetaText>
            <Icon name={'history'} size="sm" />
            {interval}
          </MetaText>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon="pen"
          type="button"
          disabled={isProvisioned}
          tooltipPlacement="top"
          aria-label="edit-group-action"
          data-testid="edit-group-action"
        >
          Edit
        </Button>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item label="Re-order rules" icon="flip" disabled={isProvisioned} />
              <Menu.Divider />
              <Menu.Item label="Export" icon="download-alt" />
              <Menu.Item label="Delete" icon="trash-alt" destructive disabled={isProvisioned} />
            </Menu>
          }
        >
          <MoreButton />
        </Dropdown>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupWrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  headerWrapper: css({
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,

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

export default EvaluationGroup;
