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
      <label className="gf-form-label query-keyword pointer" onClick={_ => setIsHelpVisible(!isHelpVisible)}>
        Help&nbsp;
        <Icon name={isHelpVisible ? 'angle-down' : 'angle-right'} />
      </label>
      {isHelpVisible && <div className={cx('grafana-info-box', 'grafana-info-box--max-lg', helpStyle)}>{children}</div>}
    </>
  );
};
