import React from 'react';
import Moveable from 'react-moveable';

const MoveableElement = ({ moveableRef, setStyle }: { moveableRef: any; setStyle: any }) => {
  const [renderMovable, setRenderMovable] = React.useState(false);

  React.useEffect(() => {
    setRenderMovable(true);
  }, []);

  const handleDrag = (event: any) => {
    setStyle(event.transform);
  };

  if (!renderMovable) {
    return null;
  }

  console.log('am being rendered', renderMovable);

  return <Moveable target={moveableRef.current} draggable={true} throttleDrag={0} onDrag={handleDrag} />;
};

export default MoveableElement;
