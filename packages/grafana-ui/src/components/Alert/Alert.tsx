import React, { FC, ReactNode } from 'react';
import classNames from 'classnames';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  title: string;
  buttonText?: string;
  onButtonClick?: (event: React.MouseEvent) => void;
  onRemove?: boolean;
  severity?: AlertVariant;
  children?: ReactNode;
}

function getIconFromSeverity(severity: AlertVariant): string {
  switch (severity) {
    case 'error': {
      return 'fa fa-exclamation-triangle';
    }
    case 'warning': {
      return 'fa fa-exclamation-triangle';
    }
    case 'info': {
      return 'fa fa-info-circle';
    }
    case 'success': {
      return 'fa fa-check';
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
          <i className={getIconFromSeverity(severity)} />
        </div>
        <div className="alert-body">
          <div className="alert-title">{title}</div>
          {children && <div className="alert-text">{children}</div>}
        </div>
        {/* If onRemove is specified , giving preference to onRemove */}
        {onRemove && (
          <button type="button" className="alert-close" onClick={onButtonClick}>
            <i className="fa fa fa-remove" />
          </button>
        )}
        {/* If onRemove is not specified and buttonText is specified, showing Button Text */}
        {!onRemove && buttonText && (
          <button type="button" className="btn btn-outline-danger" onClick={onButtonClick}>
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};
