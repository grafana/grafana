import React from 'react';
import { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { cx, css } from 'emotion';

interface DraggableMappingRowProps extends DraggableProvidedDragHandleProps {
  label?: string;
}

export const DraggableMappingRow = React.forwardRef<HTMLDivElement, DraggableMappingRowProps>(
  ({ children, label, tabIndex, ...otherProps }, ref) => {
    const styles = useStyles(getDraggableRowStyles);
    return (
      <>
        <div className="gf-form-label gf-form-label--justify-left width-5" ref={ref} {...otherProps}>
          <i className={cx('fa fa-ellipsis-v', styles.draggable)} />
          {label}
        </div>
        {children}
      </>
    );
  }
);

DraggableMappingRow.displayName = 'DraggableMappingRow';

const getDraggableRowStyles = (theme?: GrafanaTheme) => {
  if (!theme) {
    theme = {} as GrafanaTheme;
  }
  return {
    draggable: css`
      padding: 0;
      font-size: ${theme.typography.size.md};
      opacity: 0.4;
      margin-right: ${theme.spacing.md};
      &:hover {
        color: ${theme.colors.textStrong};
      }
    `,
  };
};
