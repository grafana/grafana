import React, { useRef, useState, MouseEvent, ReactNode } from 'react';

import { useSelector } from 'app/types';

interface DrawerDropZoneProps {
  children: ReactNode;
  onDrop: (x: unknown) => void;
}

export const DrawerDropZone = ({ children, onDrop }: DrawerDropZoneProps) => {
  const temp = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragData = useSelector((state) => state.investigation.data);

  const handleMoveEnter = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragData) {
      temp.current = dragData;
      setIsDragging(true);
    }
  };

  const handleMoveOver = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMoveLeave = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragData) {
      temp.current = null;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (isDragging && temp.current) {
      onDrop(temp.current);
      temp.current = null;
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
