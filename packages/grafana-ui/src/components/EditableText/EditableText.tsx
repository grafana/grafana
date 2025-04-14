import { forwardRef, useState, useCallback, useEffect } from 'react';

import { Input, Props as InputProps } from '../Input/Input';
import { Text, TextProps } from '../Text/Text';

interface BaseProps {
  editable?: boolean;
  text: string;
  textChangeHandler?: (text: string) => void;
}

export type EditableTextProps = BaseProps & Partial<TextProps> & Partial<InputProps>;

export const EditableText = forwardRef<HTMLDivElement, EditableTextProps>(
  ({ editable = false, text, textChangeHandler, ...props }, ref) => {
    const [currentText, setCurrentText] = useState(text);

    useEffect(() => {
      setCurrentText(text);
    }, [text]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.currentTarget.value;
        setCurrentText(newText);
        textChangeHandler?.(newText);
      },
      [textChangeHandler]
    );

    return (
      <div ref={ref} data-testid="EditableText">
        {editable ? (
          <Input {...props} data-testid="editable-text-input" onChange={handleChange} value={currentText} />
        ) : (
          <Text {...props}>{currentText}</Text>
        )}
      </div>
    );
  }
);

EditableText.displayName = 'EditableText';
