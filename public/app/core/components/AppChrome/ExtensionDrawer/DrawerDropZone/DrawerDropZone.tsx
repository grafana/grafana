import React, { useRef, useState, DragEvent, ReactNode } from 'react';

import { PluginExtensionGlobalDrawerDroppedData } from '@grafana/data';
import { useSelector } from 'app/types';

interface DrawerDropZoneProps {
  children: ReactNode;
  onDrop: (data: PluginExtensionGlobalDrawerDroppedData) => void;
}

export const DrawerDropZone = ({ children, onDrop }: DrawerDropZoneProps) => {
  const temp = useRef<PluginExtensionGlobalDrawerDroppedData | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const dragData = useSelector((state) => state.dragDrop.data);

  const handleMoveEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragData) {
      temp.current = dragData;
      setIsDragging(true);
    }
  };

  const handleMoveOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMoveLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragData) {
      temp.current = undefined;
      setIsDragging(false);
    }
  };

  const handleDrop = () => {
    if (isDragging && temp.current) {
      onDrop(temp.current);
      temp.current = undefined;
      setIsDragging(false);
    }
  };

  return (
    <div
      onDragEnter={handleMoveEnter}
      onDragOver={handleMoveOver}
      onDragLeave={handleMoveLeave}
      onDrop={handleDrop}
      onMouseEnter={handleMoveEnter}
      onMouseLeave={handleMoveLeave}
      onMouseUp={handleDrop}
      style={{ padding: 50, backgroundColor: isDragging ? 'green' : 'grey' }}
    >
      {children}
    </div>
  );
};
