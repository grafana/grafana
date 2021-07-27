import React, { useRef } from 'react';
import { PopoverController, Popover, ClickOutsideWrapper, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { FunctionEditorControls, FunctionEditorControlsProps } from './FunctionEditorControls';
import { FuncInstance } from './gfunc';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

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
      paddingBottom: '2px',
    }),
  };
};

const FunctionEditor: React.FC<FunctionEditorProps> = ({ onMoveLeft, onMoveRight, func, ...props }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
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
    <PopoverController content={renderContent} placement="top" hideAfter={100}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {triggerRef.current && (
              <Popover
                {...popperProps}
                referenceElement={triggerRef.current}
                wrapperClassName="popper"
                className="popper__background"
                renderArrow={({ arrowProps, placement }) => (
                  <div className="popper__arrow" data-placement={placement} {...arrowProps} />
                )}
              />
            )}
            <ClickOutsideWrapper
              onClick={() => {
                if (popperProps.show) {
                  hidePopper();
                }
              }}
            >
              <span ref={triggerRef} onClick={popperProps.show ? hidePopper : showPopper} className={styles.label}>
                {func.def.unknown && (
                  <Tooltip content={<TooltipContent />} placement="bottom">
                    <Icon data-testid="warning-icon" name="exclamation-triangle" size="xs" className={styles.icon} />
                  </Tooltip>
                )}
                {func.def.name}
              </span>
            </ClickOutsideWrapper>
          </>
        );
      }}
    </PopoverController>
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
