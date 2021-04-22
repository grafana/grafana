import React, { useState } from 'react';
import { css } from 'emotion';
import { useTheme } from '@grafana/ui';

interface Props {
  value?: string;
  onSearch: (value: string) => void;
}

export const SearchField = ({ value, onSearch }: Props) => {
  const [query, setQuery] = useState(value);
  const theme = useTheme();

  return (
    <input
      value={query}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          onSearch(e.currentTarget.value);
        }
      }}
      className={css`
        outline: none;
        font-size: 20px;
        width: 100%;
        border-bottom: 2px solid ${theme.colors.border1};
        background: transparent;
        line-height: 38px;
        font-weight: 400;
        padding: ${theme.spacing.xs};
        margin: ${theme.spacing.lg} 0;

        &::placeholder {
          color: ${theme.colors.textFaint};
        }
      `}
      placeholder="Search Grafana plugins"
      onChange={(e) => {
        setQuery(e.currentTarget.value);
      }}
    />
  );
};
