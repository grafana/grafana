import { createSlice } from '@reduxjs/toolkit';
export const initialDBaaSState = {
    selectedKubernetesCluster: null,
    selectedDBCluster: null,
};
const perconaDBaaSSlice = createSlice({
    name: 'perconaDBaaS',
    initialState: initialDBaaSState,
    reducers: {
        selectKubernetesCluster: (state, action) => (Object.assign(Object.assign({}, state), { selectedKubernetesCluster: action.payload })),
        selectDBCluster: (state, action) => (Object.assign(Object.assign({}, state), { selectedDBCluster: action.payload })),
        resetDBCluster: (state) => (Object.assign(Object.assign({}, state), { selectedDBCluster: null })),
    },
});
export const { selectDBCluster, selectKubernetesCluster, resetDBCluster } = perconaDBaaSSlice.actions;
export default perconaDBaaSSlice.reducer;
//# sourceMappingURL=dbaas.js.map