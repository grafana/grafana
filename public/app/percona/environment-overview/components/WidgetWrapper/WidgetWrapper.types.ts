import React from 'react';

export interface WidgetWrapperProps {
  children: React.ReactNode;
  title?: string;
  isPending?: boolean;
}
