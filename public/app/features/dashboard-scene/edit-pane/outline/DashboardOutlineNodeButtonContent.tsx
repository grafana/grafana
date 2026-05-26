import { type ChangeEvent, type KeyboardEvent } from 'react';

import { Trans } from '@grafana/i18n';
import { Icon, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { type EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

import { getCommonStyles } from './styles';

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
  const commonStyles = useStyles2(getCommonStyles);

  const elementName = elementInfo.tooltip ? (
    <Tooltip content={elementInfo.tooltip} placement="auto">
      <span className={commonStyles.nodeNameText}>
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
        className={commonStyles.outlineInput}
        onChange={onChangeName}
        onBlur={onInputBlur}
        onKeyDown={onInputKeyDown}
      />
    );
  }

  return (
    <>
      <div className={commonStyles.nodeName}>
        {elementName}
        {elementInfo.isHidden && <Icon name="eye-slash" size="sm" className={commonStyles.hiddenIcon} />}
      </div>
      {isCloned && (
        <span>
          <Trans i18nKey="dashboard.outline.repeated-item">Repeat</Trans>
        </span>
      )}
    </>
  );
}
