import React, { useState } from 'react';
import { css } from 'emotion';
import { Forms, useTheme } from '@grafana/ui';

interface PanelTitleProps {
  value: string;
  onChange: (value: string) => void;
}

export const PanelTitle: React.FC<PanelTitleProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();
  return (
    <>
      {isEditing ? (
        <Forms.Input
          value={value || ''}
          onChange={e => onChange(e.currentTarget.value)}
          onBlur={() => setIsEditing(false)}
          placeholder="Panel Title"
        />
      ) : (
        <span
          className={css`
            font-size: ${theme.typography.size.lg};
            margin-left: ${theme.spacing.sm};
          `}
          onClick={() => setIsEditing(true)}
        >
          {value}
        </span>
      )}
    </>
  );
};
