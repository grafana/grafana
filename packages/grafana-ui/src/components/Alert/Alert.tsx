import React, { FC, ReactNode } from 'react';
import classNames from 'classnames';
import { Unicon } from '../Icon/Unicon';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  title: string;
  buttonText?: string;
  onButtonClick?: (event: React.MouseEvent) => void;
  onRemove?: (event: React.MouseEvent) => void;
  severity?: AlertVariant;
  children?: ReactNode;
}

function getIconFromSeverity(severity: AlertVariant): string {
  switch (severity) {
    case 'error': {
      return 'exclamation-triangle';
    }
    case 'warning': {
      return 'exclamation-triangle';
    }
    case 'info': {
      return 'info-circle';
    }
    case 'success': {
      return 'check';
    }
    default:
      return '';
  }
}

export const Alert: FC<AlertProps> = ({ title, buttonText, onButtonClick, onRemove, children, severity = 'error' }) => {
  const alertClass = classNames('alert', `alert-${severity}`);
  return (
    <div className="alert-container">
      <div className={alertClass}>
        <div className="alert-icon">
          <Unicon name={getIconFromSeverity(severity)} />
        </div>
        <div className="alert-body">
          <div className="alert-title">{title}</div>
          {children && <div className="alert-text">{children}</div>}
        </div>
        {/* If onRemove is specified , giving preference to onRemove */}
        {onRemove && (
          <button type="button" className="alert-close" onClick={onRemove}>
            <Unicon name="times" />
          </button>
        )}
        {onButtonClick && (
          <button type="button" className="btn btn-outline-danger" onClick={onButtonClick}>
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};
