export const generateOptions = () => {
    const values = {
        'tes@mail.ru': 'tes@mail.ru (minLength error)',
        'test@gmailcom': 'test@gmailcom (wrong email)',
        'toolongtest@gmail.com': 'toolongtest@gmail.com (maxLength error)',
        'test@gmail.com': 'test@gmail.com (email example without errors)',
    };
    return Object.keys(values).map((key) => ({
        value: key,
        label: values[key],
    }));
};
//# sourceMappingURL=mockAsyncSelectOptions.js.map