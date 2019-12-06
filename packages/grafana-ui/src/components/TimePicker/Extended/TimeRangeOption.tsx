import React, { memo } from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  value: TimeOption;
  selected?: boolean;
  onSelect: (option: TimeOption) => void;
}

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 16px 6px 9px;
      border-left: 2px solid ${theme.background.dropdown};

      :hover {
        background: ${theme.colors.gray98};
        border-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
        border-image-slice: 1;
        border-style: solid;
        border-top: 0;
        border-right: 0;
        border-bottom: 0;
        border-left-width: 2px;
      }
    `,
  };
});

const TimeRangeOption: React.FC<Props> = ({ value, onSelect, selected = false }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

  return (
    <div className={styles.container} onClick={() => onSelect(value)} tabIndex={-1}>
      <span>{value.display}</span>
      {selected ? <i className="fa fa-check" /> : null}
    </div>
  );
};

export default memo(TimeRangeOption);
