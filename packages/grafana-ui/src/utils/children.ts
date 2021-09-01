import React, { ReactElement } from 'react';

/** Returns the ID value of the first, and only, child element  */
export function getChildId(children: ReactElement): string | undefined {
  let inputId: unknown;

  // Get the first, and only, child to retrieve form input's id
  const child = React.Children.only(children);

  // Retrieve input's id to apply on the label for correct click interaction
  // For some components (like Select), we want to get the ID from a different prop
  if ('id' in child?.props) {
    inputId = child.props.id;
  } else if ('inputId' in child.props) {
    inputId = child?.props.inputId;
  }

  return typeof inputId === 'string' ? inputId : undefined;
}
