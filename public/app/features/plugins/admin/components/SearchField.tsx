import React, { useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface Props {
  value?: string;
  onSearch: (value: string) => void;
}

export const SearchField = ({ value, onSearch }: Props) => {
  const [query, setQuery] = useState(value);
  const styles = useStyles2(getStyles);

  return (
    <input
      value={query}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          onSearch(e.currentTarget.value);
        }
      }}
      className={styles}
      placeholder="Search Grafana plugins"
      onChange={(e) => {
        setQuery(e.currentTarget.value);
      }}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => css`
  outline: none;
  font-size: 20px;
  width: 100%;
  border-bottom: 2px solid ${theme.colors.border.weak};
  background: transparent;
  line-height: 38px;
  font-weight: 400;
  padding: ${theme.spacing(0.5)};
  margin: ${theme.spacing(3)} 0;

  &::placeholder {
    color: ${theme.colors.action.disabledText};
  }
`;
