#/bin/bash

# Name the Docker inputs.
#
INPUT_REPOSITORY="$1"
INPUT_BRANCH="$2"
INPUT_HOST="$3"
INPUT_GITHUB_TOKEN="$4"
INPUT_GITHUB_PAT="$5"
INPUT_SOURCE_FOLDER="$6"
INPUT_TARGET_FOLDER="$7"
INPUT_COMMIT_AUTHOR="$8"
INPUT_COMMIT_MESSAGE="$9"
INPUT_DRYRUN="${10}"
INPUT_WORKDIR="${11}"

# Check for required inputs.
#
[ -z "$INPUT_BRANCH" ] && echo >&2 "::error::'branch' is required" && exit 1
[ -z "$INPUT_GITHUB_TOKEN" -a -z "$INPUT_GITHUB_PAT" ] && echo >&2 "::error::'github_token' or 'github_pat' is required" && exit 1

# Set state from inputs or defaults.
#
REPOSITORY="${INPUT_REPOSITORY:-${GITHUB_REPOSITORY}}"
BRANCH="${INPUT_BRANCH}"
HOST="${INPUT_GIT_HOST:-github.com}"
TOKEN="${INPUT_GITHUB_PAT:-${INPUT_GITHUB_TOKEN}}"
REMOTE="${INPUT_REMOTE:-https://${TOKEN}@${HOST}/${REPOSITORY}.git}"

SOURCE_FOLDER="${INPUT_SOURCE_FOLDER:-.}"
TARGET_FOLDER="${INPUT_TARGET_FOLDER}"

REF="${GITHUB_BASE_REF:-${GITHUB_REF}}"
REF_BRANCH=$(echo "${REF}" | rev | cut -d/ -f1 | rev)
[ -z "$REF_BRANCH" ] && echo 2>&1 "No ref branch" && exit 1

COMMIT_AUTHOR="${INPUT_AUTHOR:-${GITHUB_ACTOR} <${GITHUB_ACTOR}@users.noreply.github.com>}"
COMMIT_MESSAGE="${INPUT_COMMIT_MESSAGE:-[${GITHUB_WORKFLOW}] Publish from ${GITHUB_REPOSITORY}:${REF_BRANCH}/${SOURCE_FOLDER}}"

# Calculate the real source path.
#
SOURCE_PATH="$(realpath "${SOURCE_FOLDER}")"
[ -z "${SOURCE_PATH}" ] && exit 1
echo "::debug::SOURCE_PATH=${SOURCE_PATH}"

# Let's start doing stuff.
echo "Publishing ${SOURCE_FOLDER} to ${REMOTE}:${BRANCH}/${TARGET_FOLDER}"

# Create a working directory; the workspace may be filled with other important
# files.
#
WORK_DIR="${INPUT_WORKDIR:-$(mktemp -d "${HOME}/gitrepo.XXXXXX")}"
[ -z "${WORK_DIR}" ] && echo >&2 "::error::Failed to create temporary working directory" && exit 1
cd "${WORK_DIR}"

# Initialize git repo and configure for remote access.
#
echo "Initializing repository with remote ${REMOTE}"
git init || exit 1
git config --local user.email "${GITHUB_ACTOR}@users.noreply.github.com" || exit 1
git config --local user.name  "${GITHUB_ACTOR}" || exit 1
git remote add origin "${REMOTE}" || exit 1
git remote -v

# Fetch initial (current contents).
#
echo "Fetching ${REMOTE}:${BRANCH}"
git fetch --depth 1 origin "${BRANCH}" || exit 1
git checkout -b "${BRANCH}" || exit 1
git pull origin "${BRANCH}" || exit 1

# Create the target directory (if necessary) and copy files from source.
#
TARGET_PATH="${WORK_DIR}/${TARGET_FOLDER}"
echo "Populating ${TARGET_PATH}"
mkdir -p "${TARGET_PATH}" || exit 1
rsync -a --quiet --delete "${SOURCE_PATH}/" "${TARGET_PATH}" || exit 1

# Create commit with changes.
#
echo "Creating commit"
git add "${TARGET_PATH}" || exit 1
git commit -m "${COMMIT_MESSAGE}" --author "${COMMIT_AUTHOR}" || exit 1
COMMIT_HASH="$(git rev-parse HEAD)"
echo "Created commit ${COMMIT_HASH}"

# Publish output variables.
#
echo "::set-output name=commit_hash::${COMMIT_HASH}"
echo "::set-output name=working_directory::${WORK_DIR}"

# Push if not a dry-run.
#
if [ -z "${INPUT_DRYRUN}" ] ; then
    echo "Pushing to ${REMOTE}:${BRANCH}"
    git push origin "${BRANCH}" || exit 1
else
    echo "[DRY-RUN] Not pushing to ${REMOTE}:${BRANCH}"
fi