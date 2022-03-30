import React from 'react';
import { ActionId, ActionImpl } from 'kbar';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const ResultItem = React.forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId: ActionId;
    },
    ref: React.Ref<HTMLDivElement>
  ) => {
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) {
        return action.ancestors;
      }

      const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
      // +1 removes the currentRootAction; e.g.
      // if we are on the "Set theme" parent action,
      // the UI should not display "Set theme… > Dark"
      // but rather just "Dark"
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    const theme = useTheme2();
    const styles = getResultItemStyles(theme, active);

    return (
      <div ref={ref} className={styles.row}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: 14,
          }}
        >
          {action.icon && action.icon}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span
                      style={{
                        opacity: 0.5,
                        marginRight: 8,
                      }}
                    >
                      {ancestor.name}
                    </span>
                    <span
                      style={{
                        marginRight: 8,
                      }}
                    >
                      &rsaquo;
                    </span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && <span style={{ fontSize: 12 }}>{action.subtitle}</span>}
          </div>
        </div>
        {action.shortcut?.length ? (
          <div aria-hidden style={{ display: 'grid', gridAutoFlow: 'column', gap: '4px' }}>
            {action.shortcut.map((sc) => (
              <kbd key={sc} className={styles.shortcut}>
                {sc}
              </kbd>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);
ResultItem.displayName = 'ResultItem';

const getResultItemStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  const textColor = isActive ? theme.colors.text.maxContrast : theme.colors.text.primary;
  const rowBackgroundColor = isActive ? theme.colors.background.primary : 'transparent';
  const shortcutBackgroundColor = isActive ? theme.colors.background.secondary : theme.colors.background.primary;
  return {
    row: css`
      color: ${textColor};
      padding: ${theme.spacing(1, 2)};
      background: ${rowBackgroundColor};
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      &:before {
        display: ${isActive ? 'block' : 'none'};
        content: ' ';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 2px;
        border-radius: 2px;
        background-image: ${theme.colors.gradients.brandVertical};
      }
    `,
    shortcut: css`
      padding: ${theme.spacing(0, 1)};
      background: ${shortcutBackgroundColor};
      border-radius: 4px;
      fontsize: ${theme.typography.fontSize};
    `,
  };
};
