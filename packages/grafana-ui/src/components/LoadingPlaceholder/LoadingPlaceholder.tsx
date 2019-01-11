import React, { SFC } from 'react';

interface LoadingPlaceholderProps {
  text: string;
}

export const LoadingPlaceholder: SFC<LoadingPlaceholderProps> = ({ text }) => (
  <div className="gf-form-group">
    {text} <i className="fa fa-spinner fa-spin" />
  </div>
);
