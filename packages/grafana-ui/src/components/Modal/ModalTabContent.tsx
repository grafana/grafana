import React from 'react';
import { IconType } from '../Icon/types';
import { Icon } from '../Icon/Icon';

interface Props {
  icon?: IconType;
  iconClass?: string;
}

export const ModalTabContent: React.FC<Props> = ({ icon, iconClass, children }) => {
  let iconElem;
  const showIcon = icon || iconClass;
  if (iconClass) {
    iconElem = <i className={iconClass}></i>;
  }
  if (icon) {
    iconElem = <Icon name={icon} />;
  }

  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        {showIcon && <div className="share-modal-big-icon">{iconElem}</div>}
        <div className="share-modal-content">{children}</div>
      </div>
    </div>
  );
};
