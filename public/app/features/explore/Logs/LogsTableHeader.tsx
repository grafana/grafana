import { css } from '@emotion/css';
import React, { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ClickOutsideWrapper, Icon, Popover, useTheme2 } from '@grafana/ui';
import { CustomHeaderRendererProps } from '@grafana/ui/src/components/Table/types';

interface Props extends CustomHeaderRendererProps {
  myProp: string;
  // onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableHeaderMenu: css({
    label: 'tableHeaderMenu',
    width: '100%',
    minWidth: '250px',
    height: '100%',
    maxHeight: '400px',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    margin: theme.spacing(1, 0),
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
  button: css({
    appearance: 'none',
    right: '5px',
    background: 'none',
    border: 'none',
    padding: 0,
  }),
});

export const LogsTableHeader = (props: Props) => {
  const [showPopover, setShowPopover] = useState(false);
  const referenceElement = useRef<HTMLButtonElement | null>(null);
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <span style={{ display: 'flex' }}>
      {props.defaultContent}
      <button
        className={styles.button}
        ref={referenceElement}
        onClick={(e) => {
          setShowPopover(!showPopover);
        }}
      >
        <Icon title={props.myProp} name={'ellipsis-v'} />
      </button>
      {referenceElement.current && (
        <Popover
          show={showPopover}
          content={
            <ClickOutsideWrapper onClick={() => setShowPopover(false)} useCapture={true}>
              <div className={styles.tableHeaderMenu}>Hello interactive table menu!</div>
            </ClickOutsideWrapper>
          }
          referenceElement={referenceElement.current}
        />
      )}
    </span>
  );
};
