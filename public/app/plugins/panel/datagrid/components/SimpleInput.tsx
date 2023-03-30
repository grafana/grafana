import React, { useRef, useEffect } from 'react';

interface Props {
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder: string;
}

export const SimpleInput = ({ onBlur, placeholder }: Props) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.value = '';
    ref.current.focus();
  });

  return <input type="text" placeholder={placeholder} onBlur={onBlur} ref={ref} />;
};
