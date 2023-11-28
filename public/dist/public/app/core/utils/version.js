import { isNumber } from 'lodash';
const versionPattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z\.]+))?/;
export class SemVersion {
    constructor(version) {
        this.major = 0;
        this.minor = 0;
        this.patch = 0;
        this.meta = '';
        const match = versionPattern.exec(version);
        if (match) {
            this.major = Number(match[1]);
            this.minor = Number(match[2] || 0);
            this.patch = Number(match[3] || 0);
            this.meta = match[4];
        }
    }
    isGtOrEq(version) {
        const compared = new SemVersion(version);
        for (let i = 0; i < this.comparable.length; ++i) {
            if (this.comparable[i] > compared.comparable[i]) {
                return true;
            }
            if (this.comparable[i] < compared.comparable[i]) {
                return false;
            }
        }
        return true;
    }
    isValid() {
        return isNumber(this.major);
    }
    get comparable() {
        return [this.major, this.minor, this.patch];
    }
}
export function isVersionGtOrEq(a, b) {
    const aSemver = new SemVersion(a);
    return aSemver.isGtOrEq(b);
}
//# sourceMappingURL=version.js.map