import React from 'react';

interface FlexItemProps {
  grow?: number;
  shrink?: number;
}

const FlexItem: React.FC<FlexItemProps> = ({ grow, shrink }) => {
  return <div style={{ display: 'block', flexGrow: grow, flexShrink: shrink }} />;
};

export default FlexItem;
