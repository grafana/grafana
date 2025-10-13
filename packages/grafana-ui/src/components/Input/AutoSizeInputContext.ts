import React from 'react';

// Used to tell Input to increase the width properly of the input to fit the text.
// See comment in Input.tsx for more details
export const AutoSizeInputContext = React.createContext(false);
AutoSizeInputContext.displayName = 'AutoSizeInputContext';
