# Docker Development Environment (WIP)

This setup allows you to run your Grafana backend in Docker while running the frontend locally for optimal development experience.

## How It Works

The development environment uses a **hybrid approach**:

1. **grafana-dev**: The main Grafana backend running in Docker with hot reloading
2. **Local Frontend**: Frontend runs locally

## Key Features

- ✅ Backend runs in Docker with hot reloading via nodemon
- ✅ Frontend runs locally
- ✅ Source code is mounted from your local filesystem
- ✅ Built frontend assets are shared via volume mounting
- ✅ Persistent data storage for development
- ✅ Containerized backend + native frontend tooling

---

## 🚀 First Time Setup

### Prerequisites

- Docker and Docker Compose installed
- Node.js and Yarn installed locally

### Initial Setup Steps

1. **Start the backend container:**

   ```bash
   ./scripts/docker-dev.sh start
   ```

2. **Start the frontend watcher (in a separate terminal):**

   ```bash
   yarn start or yarn start:liveReload
   ```

3. **Access Grafana:**

   - Main application: http://localhost:3000

---

## 📅 Daily Usage (After First Setup)

```bash
./scripts/docker-dev.sh start    # Quick start
./scripts/docker-dev.sh stop     # Quick stop
./scripts/docker-dev.sh logs     # View logs
```

### When You Need to Rebuild:

```bash
./scripts/docker-dev.sh build    # Only when needed
```

### Quick Status Check

```bash
# View backend logs
./scripts/docker-dev.sh logs

# Check what's running
docker ps
```

---

## 🔧 Available Commands

### Backend Management

```bash
# Start backend container
./scripts/docker-dev.sh start

# Stop backend container
./scripts/docker-dev.sh stop

# View backend logs
./scripts/docker-dev.sh logs
```

---

## 🛠 Development Workflow

### Making Changes

1. **Frontend Changes:**

   - Edit files in `public/`, `packages/`, etc.
   - `yarn start:liveReload` automatically detects changes
   - Assets are rebuilt and **browser automatically refreshes**

2. **Backend Changes:**

   - Edit files in `pkg/`, `apps/`, etc.
   - Backend service automatically restarts via nodemon
   - Manually refresh browser to see changes

3. **Configuration Changes:**
   - Edit files in `conf/`
   - Backend automatically restarts

### File Structure

```
├── docker-compose.dev.yml    # Docker backend configuration
├── Dockerfile.dev            # Development backend image
└── scripts/
    ├── docker-dev.sh         # Backend management script
    └── run-dev.sh           # Internal container startup script
```

### How the Setup Works

**Volume Mounting**: Your local source code is mounted into the backend container:

- **Source Code**: `public/`, `packages/`, `pkg/`, `apps/`, etc.
- **Build Output**: `public/build/` is mounted so backend can serve frontend assets
- **Dependencies**: `node_modules/`, `.yarn/` for consistency
- **Persistent Data**: Grafana data and logs persist across container restarts

**Development Workflow**:

1. **Backend**: Docker container with nodemon watching for Go file changes
2. **Frontend**: Local `yarn start:liveReload` watching for frontend changes
3. **Asset Sharing**: Built frontend assets are mounted into Docker container
4. **Live Reload**: Browser automatically refreshes when frontend changes

---

## 🐛 Troubleshooting

### Common Issues

1. **Backend not seeing frontend changes**: Ensure the `public/build/` directory is being mounted correctly

2. **Permission issues**:

   ```bash
   ./scripts/docker-dev.sh stop
   ./scripts/docker-dev.sh start
   ```

### Debugging

- **Backend logs**: `./scripts/docker-dev.sh logs`
- **Container status**: `docker ps`

## ⚡ Performance Notes

- Frontend builds are faster running locally vs in Docker
- Backend hot reloading works reliably with nodemon
- Docker layer caching speeds up backend container restarts

## 🔄 Comparison with Other Approaches

| Approach        | Pros                   | Cons                         |
| --------------- | ---------------------- | ---------------------------- |
| All Local       | Fast, simple           | Less consistent environment  |
| All Docker      | Consistent environment | File watching issues, slower |
| **This Hybrid** | **Fast + Consistent**  | **Requires two terminals**   |

This hybrid setup gives you the best of both worlds: containerized backend consistency with native frontend development speed!
