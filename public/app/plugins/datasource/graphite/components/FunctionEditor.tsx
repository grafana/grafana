import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { FuncInstance } from '../gfunc';

import { FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';

interface FunctionEditorProps extends FunctionEditorControlsProps {
  func: FuncInstance;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      margin-right: ${theme.spacing(0.5)};
    `,
    label: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize, // to match .gf-form-label
      cursor: 'pointer',
      display: 'inline-block',
    }),
  };
};

const FunctionEditor: React.FC<FunctionEditorProps> = ({ onMoveLeft, onMoveRight, func, ...props }) => {
  const styles = useStyles2(getStyles);

  const renderContent = ({ updatePopperPosition }: any) => (
    <FunctionEditorControls
      {...props}
      func={func}
      onMoveLeft={() => {
        onMoveLeft(func);
        updatePopperPosition();
      }}
      onMoveRight={() => {
        onMoveRight(func);
        updatePopperPosition();
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

const TooltipContent = React.memo(() => {
  return (
    <span>
      This function is not supported. Check your function for typos and{' '}
      <a
        target="_blank"
        className="external-link"
        rel="noreferrer noopener"
        href="https://graphite.readthedocs.io/en/latest/functions.html"
      >
        read the docs
      </a>{' '}
      to see whether you need to upgrade your data source’s version to make this function available.
    </span>
  );
});
TooltipContent.displayName = 'FunctionEditorTooltipContent';

export { FunctionEditor };
