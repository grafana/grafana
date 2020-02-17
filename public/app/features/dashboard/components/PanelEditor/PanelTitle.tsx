import React, { useState } from 'react';
import { css } from 'emotion';
import { Forms, useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

interface PanelTitleProps {
  value: string;
  onChange: (value: string) => void;
}

export const PanelTitle: React.FC<PanelTitleProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      {isEditing ? (
        <Forms.Input
          value={value || ''}
          ref={elem => elem && elem.focus()}
          onChange={e => onChange(e.currentTarget.value)}
          onBlur={() => setIsEditing(false)}
          placeholder="Panel Title"
        />
      ) : (
        <span onClick={() => setIsEditing(true)}>{value}</span>
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      font-size: ${theme.typography.size.lg};
      padding-left: ${theme.spacing.md};
    `,
  };
});
