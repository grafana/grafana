import React, { useContext } from 'react';
import { ThemeContext } from '../../themes/ThemeContext';
import { css } from 'emotion';

interface TransformationRowProps {
  name: string;
  description: string;
  editor?: JSX.Element;
  onRemove: () => void;
}

export const TransformationRow = ({ onRemove, editor, name }: TransformationRowProps) => {
  const theme = useContext(ThemeContext);
  return (
    <div
      className={css`
        margin-bottom: 10px;
      `}
    >
      <div
        className={css`
          display: flex;
          padding: 4px 8px 4px 8px;
          position: relative;
          height: 35px;
          background: ${theme.colors.textFaint};
          border-radius: 4px 4px 0 0;
          flex-wrap: nowrap;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <div
          className={css`
            font-weight: ${theme.typography.weight.semibold};
            color: ${theme.colors.blue};
          `}
        >
          {name}
        </div>
        <div>
          <div
            onClick={onRemove}
            className={css`
              background: transparent;
              border: none;
              box-shadow: none;
              cursor: pointer;
              color: ${theme.colors.textWeak};
              &:hover {
                color: ${theme.colors.text};
              }
            `}
          >
            <i className="fa fa-fw fa-trash" />
          </div>
        </div>
      </div>
      {editor && (
        <div
          className={css`
            border: 2px dashed ${theme.colors.textFaint};
            border-top: none;
            border-radius: 0 0 4px 4px;
            padding: 8px;
          `}
        >
          {editor}
        </div>
      )}
    </div>
  );
};
