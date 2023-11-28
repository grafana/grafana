import { Family } from './Advisors.types';
export const groupAdvisorsIntoCategories = (advisors) => {
    const result = {};
    advisors.forEach((advisor) => {
        const { category, summary, checks } = advisor;
        const modifiedChecks = checks.map((check) => (Object.assign(Object.assign({}, check), { family: check.family ? Family[check.family] : undefined, disabled: check.disabled ? true : false })));
        if (!result[category]) {
            result[category] = {};
        }
        if (!result[category][summary]) {
            result[category][summary] = Object.assign(Object.assign({}, advisor), { checks: [...modifiedChecks] });
        }
    });
    return result;
};
//# sourceMappingURL=Advisors.utils.js.map