## Local Setup

1. Create `.env` in the project root with credentials (see `.claude/skills/git-sync/.env.example`). Ensure `.env` is in `.gitignore`.
2. Source the credentials:
   ```bash
   source .claude/skills/git-sync/shared/scripts/load-env.sh
   ```
3. Add the feature toggles to `conf/custom.ini`:
   ```ini
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true
   provisioningFolderMetadata = true
   ```
4. Grafana must be running at `http://localhost:3000`.
5. **Log in to Grafana:** Open browser to `http://localhost:3000`. Log in as `admin`/`admin`. Skip password change if prompted.

## Cloud Setup

On a cloud VM, Grafana must be built and started from scratch.

1. **Create `conf/custom.ini`** (does not exist by default; it is gitignored):

   ```bash
   cat > conf/custom.ini << 'EOF'
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true
   provisioningFolderMetadata = true
   EOF
   ```

   Do NOT edit `conf/defaults.ini`.

2. **Start Grafana:**

   ```bash
   # Backend (first build ~3 min, hot-reload after)
   make run &
   # Frontend dev server (~45s first compile)
   yarn start &
   ```

3. **Wait for health:**

   ```bash
   for i in $(seq 1 60); do
     if curl -sf http://localhost:3000/api/health > /dev/null; then
       echo "Grafana is ready"
       break
     fi
     echo "Waiting for Grafana... ($i/60)"
     sleep 5
   done
   ```

4. **Secrets** are available as environment variables (configured in Cursor dashboard). Do not use `.env` files. Verify every variable in this skill's **Required Secrets** table is set and non-empty before proceeding.

5. **Log in to Grafana:** Open browser to `http://localhost:3000`. Log in as `admin`/`admin`. Skip password change if prompted.
