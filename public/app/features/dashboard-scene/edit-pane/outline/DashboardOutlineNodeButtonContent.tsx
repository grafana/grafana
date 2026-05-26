import { css } from '@emotion/css';
import { type ChangeEvent, type KeyboardEvent } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { type EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

interface DashboardOutlineNodeButtonContentProps {
  elementInfo: EditableDashboardElementInfo;
  instanceName: string;
  isCloned: boolean;
  isRenaming: boolean | undefined;
  renameInputRef: (ref: HTMLInputElement | null) => void;
  onChangeName: (evt: ChangeEvent<HTMLInputElement>) => void;
  onInputBlur: () => void;
  onInputKeyDown: (evt: KeyboardEvent) => void;
}

export function DashboardOutlineNodeButtonContent({
  elementInfo,
  instanceName,
  isCloned,
  isRenaming,
  renameInputRef,
  onChangeName,
  onInputBlur,
  onInputKeyDown,
}: DashboardOutlineNodeButtonContentProps) {
  const styles = useStyles2(getStyles);

  const elementName = elementInfo.tooltip ? (
    <Tooltip content={elementInfo.tooltip} placement="auto">
      <span className={styles.nodeNameText}>
        <Text truncate>{instanceName}</Text>
      </span>
    </Tooltip>
  ) : (
    <Text truncate>{instanceName}</Text>
  );

  if (isRenaming) {
    return (
      <input
        ref={renameInputRef}
        type="text"
        value={elementInfo.instanceName}
        className={styles.outlineInput}
        onChange={onChangeName}
        onBlur={onInputBlur}
        onKeyDown={onInputKeyDown}
      />
    );
  }

  return (
    <>
      <div className={styles.nodeName}>
        {elementName}
        {elementInfo.isHidden && <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />}
      </div>
      {isCloned && (
        <span>
          <Trans i18nKey="dashboard.outline.repeated-item">Repeat</Trans>
        </span>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    nodeName: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      alignItems: 'center',
      overflow: 'hidden',
    }),
    nodeNameText: css({
      display: 'inline-flex',
      alignItems: 'center',
      overflow: 'hidden',
      minWidth: 0,
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    outlineInput: css({
      border: `1px solid ${theme.components.input.borderColor}`,
      height: theme.spacing(3),
      borderRadius: theme.shape.radius.default,

      '&:focus': {
        outline: 'none',
        boxShadow: 'none',
      },
    }),
  };
}
