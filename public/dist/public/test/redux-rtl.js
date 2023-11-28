import { __rest } from "tslib";
import { configureStore } from '@reduxjs/toolkit';
import { render as rtlRender } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { createRootReducer } from 'app/core/reducers/root';
import { mockNavModel } from './mocks/navModel';
function render(ui, _a = {}) {
    var { preloadedState = { navIndex: mockNavModel }, store = configureStore({
        reducer: createRootReducer(),
        preloadedState,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }),
    }) } = _a, renderOptions = __rest(_a, ["preloadedState", "store"]);
    function Wrapper({ children }) {
        return React.createElement(Provider, { store: store }, children);
    }
    return rtlRender(ui, Object.assign({ wrapper: Wrapper }, renderOptions));
}
export { render };
//# sourceMappingURL=redux-rtl.js.map