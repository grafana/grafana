import { Icon } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useState } from 'react';

const helpStyle = css`
  margin-top: 4px;
`;

export const HelpToggle: React.FunctionComponent = ({ children }) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  return (
    <>
      <button className="gf-form-label query-keyword pointer" onClick={_ => setIsHelpVisible(!isHelpVisible)}>
        Help
        <Icon name={isHelpVisible ? 'angle-down' : 'angle-right'} />
      </button>
      {isHelpVisible && <div className={cx('grafana-info-box', 'grafana-info-box--max-lg', helpStyle)}>{children}</div>}
    </>
  );
};
