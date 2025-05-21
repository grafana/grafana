import { css } from '@emotion/css';
import { DropdownIndicatorProps } from 'react-select';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

export function DropdownIndicator({ selectProps }: DropdownIndicatorProps) {
  const isOpen = selectProps.menuIsOpen;
  const icon = isOpen ? 'search' : 'angle-down';
  const size = 'md';
  const styles = useStyles2(getStyles);

  if (selectProps.isLoading) {
    return <Spinner inline className={styles.spinner} />;
  }

  return <Icon name={icon} size={size} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  spinner: css({
    marginTop: -4, // Because the spinner is misaligned for some reason
  }),
});
