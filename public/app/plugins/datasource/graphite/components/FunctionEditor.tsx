import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, TextLink, Tooltip, useStyles2, type PopoverContent } from '@grafana/ui';

import { FuncInstance } from '../gfunc';

import { FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';

interface FunctionEditorProps extends FunctionEditorControlsProps {
  func: FuncInstance;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      marginRight: theme.spacing(0.5),
    }),
    label: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      display: 'inline-block',
      overflowWrap: 'anywhere',
      height: '100%',
    }),
  };
};

const FunctionEditor = ({ onMoveLeft, onMoveRight, func, ...props }: FunctionEditorProps) => {
  const styles = useStyles2(getStyles);

  const renderContent: PopoverContent = ({ updatePopperPosition }) => (
    <FunctionEditorControls
      {...props}
      func={func}
      onMoveLeft={() => {
        onMoveLeft(func);
        updatePopperPosition?.();
      }}
      onMoveRight={() => {
        onMoveRight(func);
        updatePopperPosition?.();
      }}
    />
  );

  return (
    <>
      {func.def.unknown && (
        <Tooltip content={<TooltipContent />} placement="bottom" interactive>
          <Icon data-testid="warning-icon" name="exclamation-triangle" size="xs" className={styles.icon} />
        </Tooltip>
      )}
      <Tooltip content={renderContent} placement="top" interactive>
        <span className={styles.label}>{func.def.name}</span>
      </Tooltip>
    </>
  );
};

const TooltipContent = memo(() => {
  return (
    <span>
      This function is not supported. Check your function for typos and{' '}
      <TextLink external href="https://graphite.readthedocs.io/en/latest/functions.html">
        read the docs
      </TextLink>{' '}
      to see whether you need to upgrade your data source’s version to make this function available.
    </span>
  );
});
TooltipContent.displayName = 'FunctionEditorTooltipContent';

export { FunctionEditor };
