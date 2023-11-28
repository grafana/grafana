import React, { createContext, useContext } from 'react';
export const CorrelationsFormContext = createContext({
    loading: false,
    correlation: undefined,
    readOnly: false,
});
export const CorrelationsFormContextProvider = (props) => {
    const { data, children } = props;
    return React.createElement(CorrelationsFormContext.Provider, { value: data }, children);
};
export const useCorrelationsFormContext = () => {
    return useContext(CorrelationsFormContext);
};
//# sourceMappingURL=correlationsFormContext.js.map