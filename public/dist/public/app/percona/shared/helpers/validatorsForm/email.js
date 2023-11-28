const emailRe = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export const email = (value) => {
    // Checking for no value is the responsibility of the `required` validator
    if (value == null) {
        return undefined;
    }
    return emailRe.test(value) ? undefined : 'Invalid email address';
};
//# sourceMappingURL=email.js.map