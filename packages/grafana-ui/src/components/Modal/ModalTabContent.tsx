import React from 'react';
import { cx } from 'emotion';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';

interface Props {
  icon?: IconName;
  iconClass?: string;
}

export const ModalTabContent: React.FC<Props> = ({ icon, iconClass, children }) => {
  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        {icon && <Icon name={icon} size="xxl" className={cx(iconClass, 'share-modal-big-icon')} />}
        <div className="share-modal-content">{children}</div>
      </div>
    </div>
  );
};
