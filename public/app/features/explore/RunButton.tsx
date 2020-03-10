import React from 'react';
import { RefreshPicker } from '@grafana/ui';
import memoizeOne from 'memoize-one';
import { css } from 'emotion';
import classNames from 'classnames';

import { ResponsiveButton } from './ResponsiveButton';

const getStyles = memoizeOne(() => {
  return {
    selectButtonOverride: css`
      label: selectButtonOverride;
      .select-button-value {
        color: white !important;
      }
    `,
  };
});

type Props = {
  splitted: boolean;
  loading: boolean;
  onRun: (loading: boolean) => void;
  refreshInterval?: string;
  onChangeRefreshInterval: (interval: string) => void;
  showDropdown: boolean;
};

export function RunButton(props: Props) {
  const { splitted, loading, onRun, onChangeRefreshInterval, refreshInterval, showDropdown } = props;
  const styles = getStyles();
  const buttonRef = React.createRef<HTMLButtonElement>();

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // In order to prevent blurring of the QueryField on mousedown, we prevent default behavior here.
    // Instead, the QueryField is blurred after we start running queries without running them again.
    e.preventDefault();
  };

  const handleMouseUp = () => {
    onRun(loading);
    buttonRef.current.focus();
    return;
  };

  const runButton = (
    <ResponsiveButton
      ref={buttonRef}
      splitted={splitted}
      title={loading ? 'Cancel' : 'Run Query'}
      onMouseUp={handleMouseUp}
      onMouseDown={handleMouseDown}
      buttonClassName={classNames({
        'navbar-button--secondary': !loading,
        'navbar-button--danger': loading,
        'btn--radius-right-0': showDropdown,
      })}
      iconClassName={loading ? 'fa fa-spinner fa-fw fa-spin run-icon' : 'fa fa-refresh fa-fw'}
    />
  );

  if (showDropdown) {
    return (
      <RefreshPicker
        onIntervalChanged={onChangeRefreshInterval}
        value={refreshInterval}
        buttonSelectClassName={`${loading ? 'navbar-button--danger' : 'navbar-button--secondary'} ${
          styles.selectButtonOverride
        }`}
        refreshButton={runButton}
      />
    );
  }
  return runButton;
}
