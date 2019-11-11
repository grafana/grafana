import React, { FC, ReactNode } from 'react';
import classNames from 'classnames';

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
          <button type="button" className="alert-close" onClick={onRemove}>
            <i className="fa fa fa-remove" />
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
